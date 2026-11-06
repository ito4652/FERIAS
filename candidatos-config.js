/* Conexión con Supabase para la sección Candidatos.
   La clave "publishable"/"anon" está pensada para ir en apps web: no es secreta.
   Lo que protege los datos son las reglas de la base (solo cuentas @icb.cl con sesión iniciada)
   y que el registro público esté desactivado. Instrucciones en CANDIDATOS.md. */
window.CAND_CONFIG = {
  supabaseUrl: 'https://ytfbnvxwwjayofibehyk.supabase.co',
  supabaseKey: 'sb_publishable_taGPRCscCU4pZ0YTMVmEKg_d2SrIJwH',
  alertDays: 30         // Avisar cuando falten estos días o menos para que empiecen a buscar
};
