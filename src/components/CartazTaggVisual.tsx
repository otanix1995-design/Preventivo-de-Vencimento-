import React from 'react';
import type { CartazItem } from '../types';
import { decomporDescricaoTag, formatarCodigoSemZeros } from '../utils/cartazes';
import { getTemplateImage } from '../utils/templateBackground';

interface CartazTaggVisualProps {
  item?: CartazItem | null;
  className?: string;
  isTemplateLimpo?: boolean;
}

/**
 * Renders an exact visual replica of the official Supermarket Offer Poster.
 * - Displays the official clean background template directly as the base layer.
 * - Overlays ONLY the dynamic product text on top of the fixed coordinates.
 */
export const CartazTaggVisual: React.FC<CartazTaggVisualProps> = ({
  item,
  className = '',
  isTemplateLimpo = false,
}) => {
  const bgImage = getTemplateImage('SINGLE_TAG');
  const showContent = Boolean(item && !isTemplateLimpo);

  const parsed = item ? decomporDescricaoTag(item.descricao, item.marca) : null;
  const priceVal = item && item.precoVenda !== null && item.precoVenda !== undefined ? item.precoVenda : 0;
  const priceStr = priceVal.toFixed(2);
  const [intPart, decPart] = priceStr.split('.');
  const cleanCod = item ? formatarCodigoSemZeros(item.codigo) : '';
  const cleanDig = item && item.dig ? item.dig.replace(/^0+/, '') || item.dig : '0';

  const embRaw = (item?.embalagem || 'UN').trim();
  const embFmt = embRaw.startsWith('(') ? embRaw : `(${embRaw})`;

  // Formatted expiration date (Validade)
  const validadeFmt = item?.dataVencimento
    ? (() => {
        const parts = item.dataVencimento.split('-');
        if (parts.length === 3) {
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return item.dataVencimento;
      })()
    : null;

  return (
    <div
      className={`relative w-full aspect-[142/98] bg-white text-slate-900 shadow-2xl border border-slate-300 rounded-xl overflow-hidden select-none ${className}`}
      style={{ fontFamily: "'Arial Black', 'Helvetica Neue', Arial, sans-serif" }}
    >
      {/* 1. Official Graphic Background Layer (Clean Layout Base) */}
      <img
        src={bgImage}
        alt="Template Oficial TAGG"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
      />

      {/* 2. Dynamic Text & Pricing Layer Overlaid ONLY when product is selected */}
      {showContent && item && (
        <div className="absolute inset-0 z-10 flex flex-col justify-between pointer-events-none">
          {/* Top spacer for the official header banner (~21.5% height) */}
          <div className="h-[22%]" />

          {/* Content Body */}
          <div className="flex-1 px-4 py-1 flex justify-between relative">
            {/* 2.1 Left Column: Descrição da Mercadoria + Validade + Caixa + Código Técnico */}
            <div className="w-[52%] flex flex-col justify-between pt-1">
              {/* Centered Product Description */}
              <div className="text-center space-y-0.5">
                {/* Linha 1: Tipo */}
                <h4 className="font-black italic text-sm sm:text-base md:text-lg text-black uppercase tracking-tight leading-tight">
                  {parsed?.tipo || item.descricao.slice(0, 18)}
                </h4>
                {/* Linha 2: Marca */}
                {parsed?.marcaLinha && (
                  <h5 className="font-black italic text-xs sm:text-sm md:text-base text-black uppercase tracking-tight leading-tight">
                    {parsed.marcaLinha}
                  </h5>
                )}
                {/* Linha 3: Variação / Sabor */}
                {parsed?.variacao && (
                  <p className="font-black italic text-xs sm:text-sm text-black uppercase tracking-tight leading-tight">
                    {parsed.variacao}
                  </p>
                )}
                {/* Linha 4: Embalagem */}
                <p className="font-black italic text-xs sm:text-sm text-black leading-tight">
                  {embFmt}
                </p>

                {/* Linha 5: Validade de Vencimento */}
                {validadeFmt && (
                  <div className="pt-0.5">
                    <span className="inline-block px-1 py-0.2 bg-black text-white text-[8px] sm:text-[9px] font-black rounded-[1px] tracking-tight">
                      VALIDADE: {validadeFmt}
                    </span>
                  </div>
                )}

                {/* Linha 6: Caixa pack info */}
                {item.unidadesPorCaixa && item.unidadesPorCaixa > 1 && item.precoCaixa && (
                  <p className="font-black italic text-[10px] sm:text-xs text-black pt-0.5 leading-tight">
                    CXA C/ {item.unidadesPorCaixa} R$ {item.precoCaixa.toFixed(2).replace('.', ',')}
                  </p>
                )}
              </div>

              {/* 2.2 Technical footer (Mini QR + Barcode + Code :p:xxx:d:yyy) placed at bottom */}
              <div className="pb-1 pl-1">
                <div className="flex items-center gap-1.5">
                  {/* Mini QR code */}
                  <div className="w-4 h-4 sm:w-5 sm:h-5 bg-black p-0.5 rounded-[1px] flex items-center justify-center shrink-0">
                    <div className="w-full h-full border border-white flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-white" />
                    </div>
                  </div>

                  {/* Linear barcode representation */}
                  <div className="flex flex-col">
                    <div className="h-2.5 sm:h-3 flex items-center gap-[1.5px]">
                      {[4, 2, 6, 2, 7, 3, 5, 2, 6, 3, 5, 2, 4, 7, 3, 2, 6, 4, 2, 5, 3, 6, 2, 5, 4, 2, 6].map(
                        (h, i) => (
                          <div key={i} className="bg-black w-[1.5px]" style={{ height: `${h + 3}px` }} />
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* Code line */}
                <div className="mt-0.5">
                  <span className="font-mono font-black text-[8px] sm:text-[9px] text-black tracking-tight">
                    :p:{cleanCod}:d:{cleanDig}
                  </span>
                </div>
              </div>
            </div>

            {/* 2.3 Right Column: Preço do Produto */}
            <div className="w-[48%] flex flex-col justify-start items-end text-right pr-2">
              {/* Price display - GIANT NUMBERS */}
              <div className="w-full flex flex-col items-end pt-1">
                <span className="font-black italic text-xs sm:text-sm text-black mr-20 sm:mr-28">
                  R$
                </span>
                <div className="flex items-start justify-end text-[#D01E1E] font-black leading-none -mt-2">
                  <span
                    className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tighter italic"
                    style={{ fontWeight: 900 }}
                  >
                    {intPart}
                  </span>
                  <span
                    className="text-2xl sm:text-3xl md:text-4xl pt-1 italic"
                    style={{ fontWeight: 900 }}
                  >
                    ,{decPart}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
