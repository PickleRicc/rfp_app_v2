'use client';

import React from 'react';

interface VolumeViewerProps {
  content: any;
}

/**
 * Volume Viewer Component
 * Displays proposal volume content in a readable format
 */
export function VolumeViewer({ content }: VolumeViewerProps) {
  if (!content || !content.sections) {
    return (
      <div className="p-8 text-center text-gray-500">
        No content available for this volume.
      </div>
    );
  }

  return (
    <div className="prose prose-blue max-w-none p-6">
      {content.sections.map((section: any, idx: number) => (
        <div key={idx} className="mb-8">
          <h2 className="text-2xl font-bold text-blue-600 border-b-2 border-blue-600 pb-2 mb-4">
            {section.title}
          </h2>
          
          <div className="space-y-4">
            {Array.isArray(section.content) ? (
              // Handle array of paragraphs
              section.content.map((para: any, paraIdx: number) => (
                <div key={paraIdx} className="text-gray-700 leading-relaxed">
                  {typeof para === 'string' ? (
                    <p>{para}</p>
                  ) : para.text ? (
                    <p>{para.text}</p>
                  ) : (
                    <p>{JSON.stringify(para)}</p>
                  )}
                </div>
              ))
            ) : typeof section.content === 'string' ? (
              // Handle string content
              section.content.split('\n\n').map((para: string, paraIdx: number) => (
                <p key={paraIdx} className="text-gray-700 leading-relaxed">
                  {para}
                </p>
              ))
            ) : (
              <div className="text-gray-500 italic">
                Content format not supported
              </div>
            )}
          </div>

          {/* Show exhibits if any */}
          {section.exhibits && section.exhibits.length > 0 && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-2">Exhibits:</h4>
              <ul className="list-disc list-inside space-y-1">
                {section.exhibits.map((exhibit: any, exhibitIdx: number) => (
                  <li key={exhibitIdx} className="text-blue-700">
                    Exhibit {exhibit.number}: {exhibit.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
