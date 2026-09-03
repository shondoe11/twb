//* inline svg version of icon.svg so it inherits currentColor fr surrounding text (blue-600 / dark:blue-400 in nav)
export default function TwbIcon({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="2 1.6 196.4 196.8"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <g fill="none" stroke="currentColor">
        <g strokeWidth="3">
          <path d="m0 16v-16h16" />
          <path d="m200 16v-16h-16" />
          <path d="m0 184v16h16" />
          <path d="m200 184v16h-16" />
        </g>
        <path
          strokeWidth="10"
          strokeLinecap="round"
          d="m29.962 43.145c-0.50668 7.5599 0.84208 15.237 3.8951 22.172 3.4553 7.8484 9.2224 14.822 16.779 18.876 9.2613 4.9689 20.865 5.144 30.412 0.74905 8.9145-4.1038 15.966-12.075 18.952-21.423"
        />
        <path
          strokeWidth="10"
          strokeLinecap="round"
          d="m170.04 43.145c0.50668 7.5599-0.84208 15.237-3.8951 22.172-3.4553 7.8484-9.2224 14.822-16.779 18.876-9.2613 4.9689-20.864 5.144-30.412 0.74905-8.9145-4.1038-15.966-12.075-18.952-21.423"
        />
      </g>
      <g fill="currentColor">
        <circle r="5" cy="120.75" cx="47.939" />
        <circle r="5" cy="114.14" cx="63.697" />
        <circle r="5" cy="117.98" cx="79.534" />
        <circle r="5" cy="129.68" cx="91.677" />
        <circle r="5" cy="143.82" cx="100" />
        <circle r="5" cy="160.81" cx="100" />
        <circle r="5" cy="177.7" cx="100" />
        <circle r="5" cy="120.75" cx="152.06" />
        <circle r="5" cy="114.14" cx="136.3" />
        <circle r="5" cy="117.98" cx="120.47" />
        <circle r="5" cy="129.68" cx="108.32" />
      </g>
    </svg>
  );
}
