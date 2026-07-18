import Image from 'next/image';

export function BrandLogo({ className = 'brand-logo' }: { readonly className?: string }) {
  return <Image className={className} src="/images/brand/tacit-logo.png" alt="Tacit" width={1783} height={882} priority />;
}
