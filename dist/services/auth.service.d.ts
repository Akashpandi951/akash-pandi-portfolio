/**
 * src/services/auth.service.ts
 * Enterprise Authentication & Role-Based Access Control (RBAC)
 */
export interface AdminTokenPayload {
    userId: string;
    email: string;
    role: 'ADMIN' | 'AUDITOR' | 'VIEWER';
}
export declare class AuthService {
    /**
     * Verify password against hash or initialized admin credential
     */
    static authenticate(email: string, password: string, clientIp?: string): Promise<{
        token: string;
        user: {
            id: string;
            email: string;
            role: string;
        };
    } | null>;
    /**
     * Verify JWT Token
     */
    static verifyToken(token: string): AdminTokenPayload | null;
}
