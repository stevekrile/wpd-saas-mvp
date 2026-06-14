import { SignUp } from '@clerk/clerk-react';

export default function RegisterPage() {
  return (
    <div className="auth-page">
      <div className="auth-container">
        <SignUp routing="hash" />
      </div>
    </div>
  );
}
