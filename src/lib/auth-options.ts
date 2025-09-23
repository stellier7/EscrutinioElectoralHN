import { NextAuthOptions } from 'next-auth';
import { prisma } from './prisma';
import { AuthUtils } from './auth';

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: 'custom',
      name: 'Custom',
      type: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
            select: {
              id: true,
              email: true,
              password: true,
              name: true,
              role: true,
              status: true,
              isActive: true,
            },
          });

          if (!user || !user.isActive) {
            return null;
          }

          const isPasswordValid = await AuthUtils.verifyPassword(
            credentials.password,
            user.password
          );

          if (!isPasswordValid) {
            return null;
          }

          // Verificar que el usuario esté aprobado
          if (user.status !== 'APPROVED') {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            status: user.status,
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      },
    },
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.status = (user as any).status;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.sub!;
        (session.user as any).role = token.role as string;
        (session.user as any).status = token.status as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.JWT_SECRET,
};
