export default function Page() {
  return (
    <main className="flex-1 size-full flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-4 sm:space-y-6">
        {/* Card 1 */}
        <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-6 sm:p-8 shadow-sm">
          <h2 className="text-xl sm:text-2xl font-semibold mb-2">Welcome</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
            This is a customizable card component
          </p>
        </div>

        {/* Card 2 */}
        <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-6 sm:p-8 shadow-sm">
          <h2 className="text-xl sm:text-2xl font-semibold mb-2">Features</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
            Add your content here
          </p>
        </div>

        {/* Card 3 */}
        <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-6 sm:p-8 shadow-sm">
          <h2 className="text-xl sm:text-2xl font-semibold mb-2">Get Started</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
            Ready to begin your journey?
          </p>
        </div>

        {/* Large Button */}
        <button className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold text-lg sm:text-xl py-4 sm:py-5 px-6 rounded-2xl shadow-lg transition-all duration-200 active:scale-95">
          Get Started
        </button>
      </div>
    </main>
  );
}
