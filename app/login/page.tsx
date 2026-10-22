import { iniciarSesion } from "./acciones";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function Login({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <main className="login">
      <h1>Iniciar sesión</h1>
      <form action={iniciarSesion}>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Contraseña
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {error && <p className="error">Email o contraseña incorrectos.</p>}
        <button type="submit">Entrar</button>
      </form>
    </main>
  );
}
