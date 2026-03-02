import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/client";
import { requireStaffOrResponse } from "@/lib/auth";
import { extractPastPerformanceFromText } from "@/lib/ingestion/past-performance-file-extractor";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

export async function POST(request: NextRequest) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;

  try {
    const companyId = request.headers.get("X-Company-Id");
    if (!companyId) {
      return NextResponse.json(
        { error: "X-Company-Id header is required" },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is 10MB.` },
        { status: 400 }
      );
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: PDF, DOCX, DOC" },
        { status: 400 }
      );
    }

    const supabase = getServerClient();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${companyId}/${Date.now()}_${sanitizedFilename}`;

    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("past-performance-files")
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file to storage" },
        { status: 500 }
      );
    }

    const { data: fileRecord, error: fileInsertError } = await supabase
      .from("past_performance_files")
      .insert({
        company_id: companyId,
        filename: sanitizedFilename,
        file_path: storagePath,
        file_size: file.size,
        mime_type: file.type,
        extraction_status: "extracting",
        ai_extraction_status: "pending",
      })
      .select()
      .single();

    if (fileInsertError || !fileRecord) {
      await supabase.storage
        .from("past-performance-files")
        .remove([storagePath]);
      console.error("Insert past_performance_files error:", fileInsertError);
      return NextResponse.json(
        { error: "Failed to record file upload" },
        { status: 500 }
      );
    }

    let extractedText: string | null = null;
    if (file.type === "application/pdf") {
      try {
        const pdfServiceUrl =
          process.env.PDF_SERVICE_URL || "http://localhost:8000";
        const pdfFormData = new FormData();
        pdfFormData.append(
          "file",
          new Blob([fileBuffer], { type: file.type }),
          sanitizedFilename
        );
        const pdfRes = await fetch(`${pdfServiceUrl}/extract-text`, {
          method: "POST",
          body: pdfFormData,
        });
        if (pdfRes.ok) {
          const result = (await pdfRes.json()) as { text?: string };
          extractedText = result.text || null;
        }
      } catch (err) {
        console.warn("PDF extraction service unavailable:", err);
      }
    } else {
      try {
        extractedText = await file.text();
      } catch {
        console.warn("Could not read file as text");
      }
    }

    if (!extractedText || extractedText.trim().length < 50) {
      await supabase
        .from("past_performance_files")
        .update({
          extraction_status: "failed",
          ai_extraction_status: "failed",
          error_message: "Could not extract readable text from the document",
        })
        .eq("id", fileRecord.id);

      return NextResponse.json({
        fileRecord,
        contracts: [],
        warning:
          "Could not extract text from the document. Please add past performance manually.",
      });
    }

    await supabase
      .from("past_performance_files")
      .update({
        extracted_text: extractedText,
        extraction_status: "extracted",
        ai_extraction_status: "processing",
      })
      .eq("id", fileRecord.id);

    let contracts: unknown[] = [];
    try {
      const extracted = await extractPastPerformanceFromText(
        extractedText,
        sanitizedFilename
      );

      const insertPayloads = extracted.map((pp) => ({
        company_id: companyId,
        ...pp,
      }));

      const { data: inserted, error: insertError } = await supabase
        .from("past_performance")
        .insert(insertPayloads)
        .select();

      if (insertError) {
        console.error("Error inserting extracted past performance:", insertError);
        await supabase
          .from("past_performance_files")
          .update({
            ai_extraction_status: "failed",
            error_message: `DB insert failed: ${insertError.message}`,
          })
          .eq("id", fileRecord.id);

        return NextResponse.json({
          fileRecord,
          contracts: [],
          warning: `AI extracted data but failed to save: ${insertError.message}`,
        });
      }

      contracts = inserted || [];

      await supabase
        .from("past_performance_files")
        .update({ ai_extraction_status: "complete" })
        .eq("id", fileRecord.id);
    } catch (aiErr) {
      console.error("AI extraction error:", aiErr);
      await supabase
        .from("past_performance_files")
        .update({
          ai_extraction_status: "failed",
          error_message:
            aiErr instanceof Error ? aiErr.message : "AI extraction failed",
        })
        .eq("id", fileRecord.id);

      return NextResponse.json({
        fileRecord,
        contracts: [],
        warning: "AI extraction failed. Please add past performance manually.",
      });
    }

    return NextResponse.json({
      fileRecord,
      contracts,
      success: true,
    });
  } catch (error) {
    console.error("Past performance upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
