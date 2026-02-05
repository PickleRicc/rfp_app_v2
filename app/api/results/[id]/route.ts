import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const documentId = id;

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }

    const supabase = getServerClient();

    // Fetch document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Fetch section results
    const { data: sections, error: sectionsError } = await supabase
      .from('section_results')
      .select('*')
      .eq('document_id', documentId)
      .order('section_number', { ascending: true });

    if (sectionsError) {
      console.error('Error fetching sections:', sectionsError);
      return NextResponse.json(
        { error: 'Failed to fetch section results' },
        { status: 500 }
      );
    }

    // Parse JSON content in sections
    const parsedSections = sections?.map((section) => ({
      ...section,
      content: typeof section.content === 'string'
        ? JSON.parse(section.content)
        : section.content,
    })) || [];

    return NextResponse.json({
      document,
      sections: parsedSections,
    });
  } catch (error) {
    console.error('Results API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
