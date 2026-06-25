import React, { useEffect, useState } from 'react';

interface SkeletonProps {
  className?: string;
  delay?: number;
}

export function Skeleton({ className = '', delay = 300 }: SkeletonProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!show) return <div className={className} />;

  return (
    <div
      className={`animate-pulse bg-white/5 rounded-md relative overflow-hidden ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    </div>
  );
}
