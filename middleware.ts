import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname.toLowerCase();

  // Bloquea el acceso a pconsumo sin redireccionar.
  if (pathname.startsWith("/pconsumo")) {
    return new NextResponse("403 - Acceso bloqueado", { status: 403 });
  }

  // Mientras la autenticacion no sea necesaria, dejamos pasar todas las solicitudes.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
