import React from 'react';

export function PasswordStrength({ password }: { password: string }) {
  const score = getScore(password);
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['#ef4444', '#f59e0b', '#10b981', '#059669'];
  const idx = Math.min(labels.length - 1, Math.max(0, score - 1));
  return (
    <div>
      <div style={{ height: 6 }} className="w-full bg-gray-200 rounded">
        <div
          className="h-full rounded"
          style={{
            width: `${(score / 4) * 100}%`,
            backgroundColor: colors[idx],
          }}
        />
      </div>
      <div className="text-xs mt-1" style={{ color: colors[idx] }}>
        {labels[idx]}
      </div>
    </div>
  );
}

function getScore(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}
