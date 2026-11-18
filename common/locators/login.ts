// Login screen of the Soft Space System Portal - the same on every BCP
// portal (FassBayar, APH). Change a selector here and both projects use it.
export const LoginLocators = {
  path: '/auth/login',
  title: 'System Portal Login',      // page heading text
  username: '#t_username',
  password: '#t_password',
  submit: '#login_btn',              // "Submit" is an <a> styled as a button
  logout: 'a.btnLogout',             // LOGOUT button once logged in
  loginErrorUrl: /\/auth\/login\?error=/
} as const;
