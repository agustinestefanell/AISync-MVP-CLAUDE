export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-3">
        {/* Spinner */}
        <div className="w-8 h-8 border-4 border-[#DDE6F1] border-t-[var(--color-accent)] rounded-full animate-spin" />
        {/* Optional text */}
        <p className="text-sm text-[#5C6B82]">Loading...</p>
      </div>
    </div>
  )
}
