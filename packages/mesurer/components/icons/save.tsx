export function SaveIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 4.5h11.7L19.5 7v12.5h-15z" />
      <path d="M8 4.5v5h8v-5M8 19.5v-5h8v5" />
    </svg>
  )
}
