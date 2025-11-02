import "../config/index";
import sgMail from "@sendgrid/mail";

interface EmailOptions {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
}

if (!process.env.SENDGRID_API_KEY) {
  console.error(
    "Error fatal: La variable de entorno SENDGRID_API_KEY no está definida."
  );
  process.exit(1);
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    const msg = {
      to: options.to,
      from: options.from,
      subject: options.subject,
      text: options.text,
      html: options.html,
    };
    await sgMail.send(msg);
    console.log("Correo de enviado exitosamente.");
  } catch (error) {
    console.error("Error al enviar el correo:", error);
    throw new Error("No se pudo enviar el correo de recuperación.");
  }
};
