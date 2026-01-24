'use client';

export default function ShapeMappingsPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Shape Mappings</h1>
        <p className="mt-1 text-sm text-gray-400">
          Map Draw.io shape styles to Threagile technology types and default properties.
        </p>
      </div>

      <div className="bg-gray-900 rounded-lg p-8 text-center">
        <svg className="mx-auto h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-white">No shape mappings configured</h3>
        <p className="mt-2 text-sm text-gray-400">
          Shape mappings will be added in checkpoint v3.2.0.
        </p>
      </div>
    </div>
  );
}
