export default function Home(): React.JSX.Element {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-primary-600 mb-4">
          ThreatDiviner
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
          DevSecOps-as-a-Service Platform
        </p>
        <div className="bg-green-100 dark:bg-green-900 border border-green-400 dark:border-green-600 rounded-lg p-4">
          <p className="text-green-700 dark:text-green-300 font-medium">
            Status: OK
          </p>
          <p className="text-sm text-green-600 dark:text-green-400">
            Dashboard is running
          </p>
        </div>
      </div>
    </main>
  );
}
