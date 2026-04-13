const sizeClasses = {
  xs: 'w-7 h-7 text-sm',
  sm: 'w-8 h-8 text-sm',
  md: 'w-12 h-12 text-xl',
  lg: 'w-20 h-20 text-3xl',
  xl: 'w-24 h-24 text-4xl',
} as const;

interface UserAvatarProps {
  username: string;
  size?: keyof typeof sizeClasses;
  color?: string; // tailwind bg class, defaults to 'bg-primary'
  className?: string;
}

export function UserAvatar({ username, size = 'md', color = 'bg-primary', className = '' }: UserAvatarProps) {
  return (
    <div className={`${sizeClasses[size]} ${color} rounded-full flex items-center justify-center font-bold text-white ${className}`}>
      {username?.charAt(0).toUpperCase() || '?'}
    </div>
  );
}
