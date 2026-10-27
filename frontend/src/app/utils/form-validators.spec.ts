import {
  cleanPhoneInput,
  cleanWhatsAppInput,
  cleanEmailInput,
  cleanWebsiteInput,
  validatePhone,
  validateWhatsApp,
  validateEmail,
  validateWebsite,
  normalizeWebsiteUrl,
} from './form-validators';

describe('form-validators', () => {
  describe('cleanPhoneInput', () => {
    it('elimina letras y simbolos no permitidos', () => {
      expect(cleanPhoneInput('abc+502 5555-1234!!')).toBe('+502 5555-1234');
      expect(cleanPhoneInput('5555-0000')).toBe('5555-0000');
    });

    it('no permite + en medio del texto', () => {
      expect(cleanPhoneInput('502+5555')).toBe('5025555');
      expect(cleanPhoneInput('+502+5555')).toBe('+5025555');
    });
  });

  describe('cleanWhatsAppInput', () => {
    it('solo permite numeros, +, espacios y guiones', () => {
      expect(cleanWhatsAppInput('hola502 5555-9999')).toBe('502 5555-9999');
    });
  });

  describe('cleanEmailInput', () => {
    it('quita espacios y pasa a minusculas', () => {
      expect(cleanEmailInput(' USER@Correo.COM ')).toBe('user@correo.com');
    });
  });

  describe('cleanWebsiteInput', () => {
    it('quita espacios', () => {
      expect(cleanWebsiteInput(' https://mi-sitio.com/inicio ')).toBe('https://mi-sitio.com/inicio');
    });
  });

  describe('validatePhone', () => {
    it('acepta telefonos validos con 8 a 15 digitos', () => {
      expect(validatePhone('55240111').valid).toBeTrue();
      expect(validatePhone('+502 5524 0111').valid).toBeTrue();
      expect(validatePhone('+1 (555) 234-5678').valid).toBeTrue();
    });

    it('rechaza telefonos con menos de 8 digitos', () => {
      const res = validatePhone('12345');
      expect(res.valid).toBeFalse();
      expect(res.error).toContain('al menos 8 dígitos');
    });

    it('rechaza telefonos con mas de 15 digitos', () => {
      const res = validatePhone('1234567890123456');
      expect(res.valid).toBeFalse();
      expect(res.error).toContain('no puede exceder');
    });

    it('permite vacio si no es requerido', () => {
      expect(validatePhone('', false).valid).toBeTrue();
      expect(validatePhone('', true).valid).toBeFalse();
    });
  });

  describe('validateWhatsApp', () => {
    it('acepta numeros de whatsapp validos', () => {
      expect(validateWhatsApp('50255240111').valid).toBeTrue();
      expect(validateWhatsApp('+502 5524 0111').valid).toBeTrue();
    });

    it('rechaza letras o caracteres invalidos', () => {
      expect(validateWhatsApp('50255wa').valid).toBeFalse();
    });
  });

  describe('validateEmail', () => {
    it('acepta correos validos', () => {
      expect(validateEmail('contacto@tienda.com').valid).toBeTrue();
      expect(validateEmail('info.ventas@sub.dominio.gt').valid).toBeTrue();
    });

    it('rechaza correos con formato invalido', () => {
      expect(validateEmail('contacto@tienda').valid).toBeFalse();
      expect(validateEmail('tienda.com').valid).toBeFalse();
      expect(validateEmail('contacto@.com').valid).toBeFalse();
    });

    it('permite vacio si no es requerido', () => {
      expect(validateEmail('', false).valid).toBeTrue();
    });
  });

  describe('validateWebsite', () => {
    it('acepta dominios y URLs validas', () => {
      expect(validateWebsite('https://minegocio.com').valid).toBeTrue();
      expect(validateWebsite('http://tienda.gt').valid).toBeTrue();
      expect(validateWebsite('www.minegocio.com/productos').valid).toBeTrue();
      expect(validateWebsite('minegocio.com').valid).toBeTrue();
    });

    it('rechaza textos que no son URLs', () => {
      expect(validateWebsite('no es una url').valid).toBeFalse();
      expect(validateWebsite('http://').valid).toBeFalse();
    });
  });

  describe('normalizeWebsiteUrl', () => {
    it('antepone https:// si no tiene protocolo', () => {
      expect(normalizeWebsiteUrl('minegocio.com')).toBe('https://minegocio.com');
      expect(normalizeWebsiteUrl('https://minegocio.com')).toBe('https://minegocio.com');
      expect(normalizeWebsiteUrl('http://minegocio.com')).toBe('http://minegocio.com');
      expect(normalizeWebsiteUrl('')).toBe('');
    });
  });
});
