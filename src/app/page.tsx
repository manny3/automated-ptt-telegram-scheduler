export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            PTT Telegram Scheduler
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Automated PTT article fetcher with Telegram bot integration
          </p>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-700">
              Configure your PTT article fetching preferences and receive updates via Telegram.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}