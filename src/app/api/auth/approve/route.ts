
import { type NextRequest, NextResponse } from 'next/server';
import { approveUserByToken } from '@/app/actions/auth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ message: 'Token de aprovação não fornecido.' }, { status: 400 });
  }

  const result = await approveUserByToken(token);

  if (result.success) {
    // Redirect to a success page or login page
    // For simplicity, returning JSON. In a real app, redirect or show an HTML page.
    // const loginUrl = new URL('/login', request.url);
    // loginUrl.searchParams.set('approvalSuccess', 'true');
    // return NextResponse.redirect(loginUrl);
     return new NextResponse(`
      <html>
        <body style="font-family: sans-serif; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f0f2f5;">
          <div style="background-color: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center;">
            <h1 style="color: #2c3e50;">Aprovação Concluída!</h1>
            <p style="color: #34495e; font-size: 1.1em;">${result.message}</p>
            <p style="margin-top: 20px;"><a href="/login" style="padding: 10px 20px; background-color: #3F51B5; color: white; text-decoration: none; border-radius: 5px; font-size: 1em;">Ir para Login</a></p>
          </div>
        </body>
      </html>`, 
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  } else {
    return new NextResponse(`
      <html>
        <body style="font-family: sans-serif; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f0f2f5;">
          <div style="background-color: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center;">
            <h1 style="color: #e74c3c;">Falha na Aprovação</h1>
            <p style="color: #34495e; font-size: 1.1em;">${result.message}</p>
            <p style="margin-top: 20px;"><a href="/login" style="padding: 10px 20px; background-color: #3F51B5; color: white; text-decoration: none; border-radius: 5px; font-size: 1em;">Tentar Login</a></p>
          </div>
        </body>
      </html>`,
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }
}
