import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

const SECRET = process.env.ENCRYPTION_KEY ?? "BingoMachine!12345!";

export interface JwtDecoded {
	id: number;
	admin: boolean;
	expiresIn: string;
}

export function signUser(user: JwtDecoded) {
	return jwt.sign(user, SECRET, {
		expiresIn: user.expiresIn,
		algorithm: "HS256",
	});
}

export function middleware(req: Request, res: Response, next: NextFunction) {
	const authHeader = req.headers["authorization"];
	const token = authHeader && authHeader.split(" ")[1];

	if (!token) return res.status(401).send("Access denied");

	try {
		const decoded = jwt.verify(token, SECRET) as JwtDecoded;
		console.log(typeof decoded);
		req.body.decoded = decoded;
		next();
		return;
	} catch (error) {
		res.status(400).send("Invalid token");
	}
}

export async function adminMiddleware(req: Request, res: Response, next: NextFunction) {
	const authHeader = req.headers["authorization"];
	const token = authHeader && authHeader.split(" ")[1];
	console.log(authHeader, token);
	if (!token) {
		res.status(401).send("Access denied");
		return;
	}
	// decode the token and check if the user is admin
	try {
		const decoded = jwt.verify(token, SECRET) as JwtDecoded;
		console.log(decoded);
		if (decoded.admin) {
			req.body.decoded = decoded;
			next();
		} else {
			res.status(401).send("Access denied");
		}
	} catch (error) {
		res.status(400).send("Invalid token");
	}
}
