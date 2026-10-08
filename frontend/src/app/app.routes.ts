import { Routes } from '@angular/router';
import { LandingPage } from './pages/landing/landing';
import { HomePage } from './pages/home/home';
import { DetailPage } from './pages/detail/detail';
import { AdminPage } from './pages/admin/admin';
import { MiNegocioPage } from './pages/mi-negocio/mi-negocio';
import { PromosPage } from './pages/promos/promos';
import { RegistroPage } from './pages/registro/registro';
import { LoginPage } from './pages/login/login';

export const routes: Routes = [
  { path: '', component: LandingPage },
  { path: 'negocios', component: HomePage },
  { path: 'negocio/:id', component: DetailPage },
  { path: 'promos', component: PromosPage },
  { path: 'login', component: LoginPage },
  { path: 'registro', component: RegistroPage },
  { path: 'admin', component: AdminPage },
  { path: 'mi-negocio', component: MiNegocioPage },
  { path: '**', redirectTo: '' },
];