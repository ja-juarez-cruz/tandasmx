import React, { useState } from 'react';
import { Shield, Phone, ArrowRight, AlertCircle } from 'lucide-react';
import logoTanda from '../public/assets/logos/logo-tanda-512.png';
import logoTandaSvg from '../public/assets/logos/logo-tanda.svg';

export default function VerifyPhone({ tandaData, onVerified }) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const formatPhoneInput = (value) => {
    // Remover todo excepto números
    const numbers = value.replace(/\D/g, '');
    // Limitar a 10 dígitos
    return numbers.slice(0, 10);
  };

  const normalizePhone = (phone) => {
    // Normalizar teléfono removiendo espacios, guiones, paréntesis, etc.
    return phone.replace(/\D/g, '');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (phone.length !== 10) {
      setError('Ingresa un número de 10 dígitos');
      return;
    }

    const phoneNormalized = normalizePhone(phone);

    // Buscar el teléfono en los participantes
    const participanteEncontrado = tandaData.participantes?.find(p => {
      const participantPhone = normalizePhone(p.telefono || '');
      return participantPhone === phoneNormalized;
    });

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
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                placeholder="5512345678"
                className="w-full pl-12 pr-4 py-4 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all text-lg font-semibold"
                autoFocus
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Solo números, sin espacios ni guiones
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
            disabled={phone.length !== 10}
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