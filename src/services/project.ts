export function validateUserInput(
  port: unknown,
  period_duration: unknown,
):
  | { valid: false; status: number; message: string }
  | { valid: true; portNumber: number } {
  const portNumber = Number(port);

  if (!port || !portNumber) {
    return {
      valid: false,
      status: 400,
      message: "Porta é obrigatório e deve ser um número valido",
    };
  }
  if (portNumber < 1024 || portNumber > 65535) {
    return {
      valid: false,
      status: 400,
      message: "Porta deve estar entre 1024 e 65535",
    };
  }
  if (
    period_duration !== undefined &&
    (!Number.isInteger(period_duration) || (period_duration as number) <= 0)
  ) {
    return {
      valid: false,
      status: 400,
      message: "Duração do período deve ser um número inteiro positivo",
    };
  }

  return { valid: true, portNumber };
}

export function assertGithubLinked(user: {
  github_id?: string | null;
  github_token?: string | null;
  github_username?: string | null;
}) {
  if (!user.github_id || !user.github_token || !user.github_username) {
    return {
      linked: false,
      message:
        "Informações do GitHub são obrigatórias, tente sincronizar com o github",
    } as const;
  }
  return { linked: true } as const;
}


