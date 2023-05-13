import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

export interface JwtDecoded {
	id: number;
	admin: boolean;
	expiresIn: string;
}

export interface AuthHandlers {
	isTokenValid(token: string): boolean;
	middleware(req: Request, res: Response, next: NextFunction): void;
	adminMiddleware(req: Request, res: Response, next: NextFunction): void;
	signUser(user: JwtDecoded): string;
}

export class AuthService implements AuthHandlers {
	private readonly SECRET: string;

	constructor(secret: string) {
		this.SECRET = secret;
		// bind all methods
		this.isTokenValid = this.isTokenValid.bind(this);
		this.middleware = this.middleware.bind(this);
		this.adminMiddleware = this.adminMiddleware.bind(this);
		this.signUser = this.signUser.bind(this);
	}
	public isTokenValid(token: string) {
		try {
			jwt.verify(token, this.SECRET) as JwtDecoded;
			return true;
		} catch (error) {
			return false;
		}
	}

	public middleware(req: Request, res: Response, next: NextFunction) {
		const authHeader = req.headers["authorization"];
		const token = authHeader && authHeader.split(" ")[1];

		if (!token) return res.status(401).json({ message: "Access denied" });

		try {
			const decoded = jwt.verify(token, this.SECRET) as JwtDecoded;
			req.body.decoded = decoded;
			next();
			return;
		} catch (error) {
			res.status(400).json({ message: "Invalid token" });
		}
	}

	public adminMiddleware(req: Request, res: Response, next: NextFunction) {
		const authHeader = req.headers["authorization"];
		const token = authHeader && authHeader.split(" ")[1];

		if (!token) {
			res.status(401).json({ message: "Access denied" });
			return;
		}
		// decode the token and check if the user is admin
		try {
			const decoded = jwt.verify(token, this.SECRET) as JwtDecoded;
			if (decoded.admin) {
				req.body.decoded = decoded;
				next();
			} else {
				res.status(401).json({ message: "Access denied" });
			}
		} catch (error) {
			res.status(400).json({ message: "Invalid token" });
		}
	}

	public signUser(user: JwtDecoded) {
		return jwt.sign(user, this.SECRET, {
			expiresIn: user.expiresIn,
			algorithm: "HS256",
		});
	}
}
