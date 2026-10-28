import type { z, ZodType } from 'zod';

export function jsonError(error: string, status: number) {
	return Response.json({ error }, { status });
}

// Parses a JSON body against `schema`. Returns the data, or a 400 response naming the first problem.
export async function readJson<S extends ZodType>(request: Request, schema: S): Promise<z.infer<S> | Response> {
	const body = await request.json().catch(() => undefined);
	const result = schema.safeParse(body);
	if (!result.success) return jsonError(result.error.issues[0]?.message ?? 'Invalid request', 400);

	return result.data;
}
