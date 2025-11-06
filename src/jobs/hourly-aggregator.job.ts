import cron, { ScheduledTask } from "node-cron";
import { DateTime } from "luxon";
import { upsertHourlyAverages } from "../services/reports.service";

const CRON_EXPRESSION = "*/5 * * * *"; // Cada 5 minutos
const JOB_ENABLED =
  (process.env.HOURLY_AGGREGATION_JOB_ENABLED ?? "true").toLowerCase() !==
  "false";

let task: ScheduledTask | undefined;

const logPrefix = "[reports/hourly-job]";

const computeLastCompletedHourWindow = () => {
  const now = DateTime.utc();
  const to = now.startOf("hour");
  const from = to.minus({ hours: 1 });
  return { from, to };
};

export const startHourlyAggregationJob = (): ScheduledTask | undefined => {
  if (!JOB_ENABLED) {
    console.log(`${logPrefix} Job deshabilitado por configuración.`);
    return undefined;
  }

  if (task) {
    return task;
  }

  task = cron.schedule(
    CRON_EXPRESSION,
    async () => {
      const { from, to } = computeLastCompletedHourWindow();
      if (from >= to) {
        return;
      }

      try {
        const result = await upsertHourlyAverages({
          from: from.toJSDate(),
          to: to.toJSDate(),
        });

        if (result.upserted > 0) {
          console.log(
            `${logPrefix} ${result.upserted} documentos actualizados para el rango ${from.toISO()} - ${to.toISO()}.`
          );
        }
      } catch (error) {
        console.error(
          `${logPrefix} Error al ejecutar la agregación horaria:`,
          error
        );
      }
    },
    {
      timezone: "UTC",
    }
  );

  console.log(`${logPrefix} Job programado cada 5 minutos.`);
  return task;
};

export const stopHourlyAggregationJob = () => {
  if (task) {
    task.stop();
    task = undefined;
  }
};
