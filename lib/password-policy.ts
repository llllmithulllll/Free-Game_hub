export const PASSWORD_MIN_LENGTH = 8;

export function getPasswordRequirements(password: string) {
  return [
    { label: `At least ${PASSWORD_MIN_LENGTH} characters`, met: password.length >= PASSWORD_MIN_LENGTH },
    { label: "At least one letter and one number", met: /[A-Za-z]/.test(password) && /\d/.test(password) },
  ];
}

export function isPasswordAcceptable(password: string) {
  return getPasswordRequirements(password).every((requirement) => requirement.met);
}
