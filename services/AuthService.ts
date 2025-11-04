const API_BASE_URL = 'https://cbinfo.no-ip.info:9011';

export type Usuario = {
  claveEmpleado: string;
  password?: string;
  sucursal?: number | null;
  sucursal_origen?: number | null;
  idDepartamento?: number | null;
  [key: string]: any;
};

class AuthService {
  private _currentUser: Usuario | null = null;

  get currentUser() {
    return this._currentUser;
  }

  async login(usuario: string, password: string): Promise<Usuario> {
    const url = `${API_BASE_URL}/api/Login/${encodeURIComponent(
      usuario,
    )}/${encodeURIComponent(password)}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Error de conexión (${res.status})`);
    }
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Usuario o contraseña incorrectos');
    }

    const user: Usuario = data[0];

    if (!user.sucursal_origen && user.sucursal) {
      user.sucursal_origen = user.sucursal;
    }

    this._currentUser = user;
    return user;
  }

  logout() {
    this._currentUser = null;
  }
}

export default new AuthService();
