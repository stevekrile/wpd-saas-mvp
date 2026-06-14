import { SignIn } from '@clerk/clerk-react';

export default function LoginPage() {
  return (
    <div className="auth-page">
      <div className="auth-container">
        <SignIn routing="hash" />
      </div>
    </div>
  );
}
