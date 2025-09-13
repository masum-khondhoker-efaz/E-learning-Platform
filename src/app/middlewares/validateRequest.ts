import { NextFunction, Request, Response } from "express";
import { AnyZodObject } from "zod";

const validateRequest =
  (schema: AnyZodObject) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsedData = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Override only what was validated
      if (parsedData.body) req.body = parsedData.body;
      // if (parsedData.query) req.query = parsedData.query;
      // if (parsedData.params) req.params = parsedData.params;

      return next();
    } catch (err) {
      next(err);
    }
  };

export default validateRequest;
