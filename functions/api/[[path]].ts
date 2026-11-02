import app from "../../worker/app";
import type { Env } from "../../worker/runtime";

export const onRequest: PagesFunction<Env> = (context) =>
  app.fetch(
    context.request,
    context.env,
    context as unknown as ExecutionContext,
  );
