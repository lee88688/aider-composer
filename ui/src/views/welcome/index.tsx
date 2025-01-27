import { RefreshCw } from 'lucide-react';

export default function Welcome() {
  return (
    <div
      style={{
        height: '100%',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div>
        <RefreshCw
          size={20}
          style={{
            animation: 'spin 2s linear infinite',
          }}
        />
      </div>
      <div>Aider Composer is starting, please wait.</div>
    </div>
  );
}
