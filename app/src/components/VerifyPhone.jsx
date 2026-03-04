import React, { useState } from 'react';
import { Shield, ArrowRight, AlertCircle } from 'lucide-react';
import logoTanda from '../public/assets/logos/logo-tanda-512.png';
import logoTandaSvg from '../public/assets/logos/logo-tanda.svg';
import { PAISES, matchesStoredPhone } from '../utils/phoneUtils';

export default function VerifyPhone({ tandaData, onVerified }) {
  const [phone, setPhone] = useState('');
  const [lada, setLada] = useState('+52');
  const [error, setError] = useState('');

  const digitosEsperados = PAISES.find(p => p.codigo === lada)?.digitos || 10;

  const formatPhoneInput = (value) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.slice(0, digitosEsperados);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (phone.length !== digitosEsperados) {
      setError(`Ingresa un número de ${digitosEsperados} dígitos`);
      return;
    }

    // Buscar el teléfono en los participantes
    const participanteEncontrado = tandaData.participantes?.find(p =>
      matchesStoredPhone(p.telefono || '', phone, lada)
    );

    if (!participanteEncontrado) {
      setError('Número no registrado en esta tanda');
      return;
    }

    // Guardar verificación en sessionStorage
    sessionStorage.setItem(`tanda_verified_${tandaData.tandaId}`, phone);
    
    // Notificar que está verificado
    onVerified(participanteEncontrado);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8">
        
        {/* ========================================= */}
        {/* HEADER: Logo y Título Centrados */}
        {/* ========================================= */}
        <div className="text-center mb-8">
          {/* Logo centrado */}
          <div className="flex justify-center mb-4">
            <img 
              src={logoTanda}
              alt="Tanda App" 
              className="w-20 h-20 object-contain drop-shadow-lg"
              onError={(e) => { e.target.src = logoTandaSvg; }}
            />
          </div>
          
          {/* Badge de seguridad */}
          <div className="flex justify-center mb-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 rounded-full">
              <Shield className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-semibold text-blue-800">Tablero Protegido</span>
            </div>
          </div>
          
          {/* Título */}
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 mb-2">
            {tandaData.nombre}
          </h1>
          
          {/* Descripción */}
          <p className="text-gray-600 text-sm md:text-base">
            Ingresa tu número telefónico para acceder al tablero
          </p>
        </div>

        {/* ========================================= */}
        {/* FORMULARIO */}
        {/* ========================================= */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Número de Teléfono
            </label>
            <div className="flex border-2 border-gray-300 rounded-xl overflow-hidden focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100 transition-all">
              <select
                value={lada}
                onChange={(e) => {
                  setLada(e.target.value);
                  setPhone('');
                  setError('');
                }}
                className="px-2 py-4 bg-gray-50 border-r border-gray-200 text-sm font-semibold text-gray-700 focus:outline-none"
              >
                {PAISES.map(p => (
                  <option key={p.codigo} value={p.codigo}>{p.bandera} {p.codigo}</option>
                ))}
              </select>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                placeholder={PAISES.find(p => p.codigo === lada)?.placeholder || ''}
                className="flex-1 px-4 py-4 bg-white focus:outline-none text-lg font-semibold"
                autoFocus
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {digitosEsperados} dígitos, solo números sin espacios
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">Error de verificación</p>
                <p className="text-xs text-red-600 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Botón de submit */}
          <button
            type="submit"
            disabled={phone.length !== digitosEsperados}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            Acceder al Tablero
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>

        {/* ========================================= */}
        {/* INFO ADICIONAL */}
        {/* ========================================= */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex items-start gap-3 text-xs text-gray-600">
            <Shield className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p>
              Tu número debe estar registrado como participante de esta tanda para poder acceder al tablero público.
            </p>
          </div>
        </div>

        {/* ========================================= */}
        {/* PREVIEW DE LA TANDA */}
        {/* ========================================= */}
        <div className="mt-6 bg-gradient-to-br from-blue-50 to-sky-50 rounded-2xl p-4 border-2 border-blue-200">
          <div className="text-center">
            <div className="text-sm text-blue-700 font-medium mb-1">Esta tanda tiene</div>
            <div className="text-2xl font-black text-blue-900">
              {tandaData.participantes?.length || 0} participantes
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}