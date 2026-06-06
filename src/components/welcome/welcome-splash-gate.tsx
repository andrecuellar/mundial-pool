import { getBoringMatches } from '@/features/welcome/boring-matches'
import { WelcomeSplash } from './welcome-splash'

// Server boundary: corre la query (cached con unstable_cache 1h) y le pasa
// los datos al componente cliente, que decide si renderear o no según
// localStorage. Mantiene el bundle del cliente ligero — no se hidrata el
// query, solo el state visible/leaving.
export async function WelcomeSplashGate() {
  const matches = await getBoringMatches()
  return <WelcomeSplash matches={matches} />
}
