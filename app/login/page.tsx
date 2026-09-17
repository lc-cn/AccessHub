import { getRbacOAuthConfig } from '@/lib/rbac-oauth'
import LoginForm from './login-form'

export default function LoginPage() {
  return <LoginForm rbacEnabled={getRbacOAuthConfig() !== null} />
}
