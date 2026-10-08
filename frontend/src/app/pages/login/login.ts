import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

type Tab = 'login' | 'register' | 'forgot';

@Component({
  selector: 'lm-login',
  imports: [RouterLink, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginPage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly tab = signal<Tab>('login');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly success = signal('');

  // Login fields
  loginIdentifier = '';
  loginPassword = '';

  // Register fields
  regName = '';
  regEmail = '';
  regPassword = '';
  regPasswordConfirm = '';
  showLoginPass = false;
  showRegPass = false;

  // Forgot password fields & steps
  forgotStep = signal<1 | 2 | 3 | 4>(1);
  forgotEmail = '';
  forgotCode = '';
  forgotNewPassword = '';
  forgotConfirmPassword = '';
  showForgotPass = false;
  demoCodeNotice = signal('');

  setTab(t: Tab) {
    this.tab.set(t);
    this.error.set('');
    this.success.set('');
    if (t === 'forgot') {
      this.forgotStep.set(1);
      this.forgotCode = '';
      this.forgotNewPassword = '';
      this.forgotConfirmPassword = '';
      this.demoCodeNotice.set('');
    }
  }

  submitLogin() {
    this.error.set('');
    if (!this.loginIdentifier.trim() || !this.loginPassword) {
      this.error.set('Ingresa tu correo/usuario y contraseña');
      return;
    }
    this.loading.set(true);
    this.api.login(this.loginIdentifier.trim(), this.loginPassword).subscribe({
      next: (r) => {
        this.loading.set(false);
        this.auth.setSession({
          token: r.token,
          username: r.username,
          role: r.role,
          businessId: r.businessId,
          name: r.name,
          email: (r as any).email,
        });
        const dest = r.role === 'admin' ? '/admin' : '/mi-negocio';
        this.router.navigate([dest]);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(e?.error?.message || 'Credenciales inválidas');
      },
    });
  }

  submitRegister() {
    this.error.set('');
    if (!this.regName.trim()) { this.error.set('El nombre es obligatorio'); return; }
    if (!this.regEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.regEmail)) {
      this.error.set('Ingresa un correo electrónico válido'); return;
    }
    if (this.regPassword.length < 6) {
      this.error.set('La contraseña debe tener al menos 6 caracteres'); return;
    }
    if (this.regPassword !== this.regPasswordConfirm) {
      this.error.set('Las contraseñas no coinciden'); return;
    }

    // derive a username from the email local part
    const username = this.regEmail.split('@')[0].replace(/[^a-z0-9._-]/gi, '-').toLowerCase().slice(0, 30);

    this.loading.set(true);
    this.api.registerUser({ username, email: this.regEmail.trim(), password: this.regPassword, name: this.regName.trim() }).subscribe({
      next: (r: any) => {
        this.loading.set(false);
        this.auth.setSession({
          token: r.token,
          username: r.user.username,
          role: r.user.role,
          name: r.user.name,
          email: r.user.email,
        });
        this.router.navigate(['/bienvenido']);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(e?.error?.message || 'No se pudo crear la cuenta');
      },
    });
  }

  // --- Recuperación de contraseña con correo ---
  submitForgotPasswordRequest() {
    this.error.set('');
    this.success.set('');
    if (!this.forgotEmail.trim()) {
      this.error.set('Ingresa tu correo electrónico registrado');
      return;
    }
    this.loading.set(true);
    this.api.forgotPassword(this.forgotEmail.trim()).subscribe({
      next: (r) => {
        this.loading.set(false);
        this.forgotStep.set(2);
        this.success.set(r.message || 'Código enviado');
        if (r.demoCode) {
          this.demoCodeNotice.set(r.demoCode);
        }
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(e?.error?.message || 'No pudimos procesar la solicitud');
      },
    });
  }

  submitVerifyCode() {
    this.error.set('');
    this.success.set('');
    if (!this.forgotCode.trim()) {
      this.error.set('Ingresa el código de 6 dígitos enviado a tu correo');
      return;
    }
    this.loading.set(true);
    this.api.verifyResetCode(this.forgotEmail.trim(), this.forgotCode.trim()).subscribe({
      next: () => {
        this.loading.set(false);
        this.forgotStep.set(3);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(e?.error?.message || 'Código incorrecto o expirado');
      },
    });
  }

  submitResetPassword() {
    this.error.set('');
    this.success.set('');
    if (this.forgotNewPassword.length < 6) {
      this.error.set('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (this.forgotNewPassword !== this.forgotConfirmPassword) {
      this.error.set('Las contraseñas no coinciden');
      return;
    }
    this.loading.set(true);
    this.api.resetPassword(this.forgotEmail.trim(), this.forgotCode.trim(), this.forgotNewPassword).subscribe({
      next: (r) => {
        this.loading.set(false);
        this.forgotStep.set(4);
        this.success.set(r.message || 'Contraseña actualizada correctamente');
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(e?.error?.message || 'No se pudo cambiar la contraseña');
      },
    });
  }

  goToLoginAfterReset() {
    this.loginIdentifier = this.forgotEmail.trim();
    this.loginPassword = '';
    this.setTab('login');
  }
}
