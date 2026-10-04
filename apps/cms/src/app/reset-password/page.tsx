import { PasswordRecoveryForm } from '../../components/password-recovery-form';
export const metadata = { referrer: 'no-referrer' as const };
export default function ResetPassword() {
  return <PasswordRecoveryForm reset />;
}
