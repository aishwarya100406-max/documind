const styles = {
  High: 'bg-green-100 text-green-700 border-green-300',
  Medium: 'bg-amber-100 text-amber-700 border-amber-300',
  Low: 'bg-red-100 text-red-700 border-red-300',
};

export default function ConfidenceBadge({ level }) {
  if (!level) return null;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${styles[level] || styles.Low}`}>
      {level} relevance
    </span>
  );
}
