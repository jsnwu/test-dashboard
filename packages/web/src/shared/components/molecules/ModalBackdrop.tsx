export interface ModalBackdropProps {
    onClick: () => void
    blur?: 'none' | 'sm' | 'md' | 'lg'
    className?: string
}

export function ModalBackdrop({onClick, blur = 'sm', className = ''}: ModalBackdropProps) {
    const blurClasses = {
        none: '',
        sm: 'backdrop-blur-sm',
        md: 'backdrop-blur-md',
        lg: 'backdrop-blur-lg',
    }

    return (
        <div
            className={`fixed inset-0 bg-black/50 ${blurClasses[blur]} ${className}`.trim()}
            onClick={onClick}
            aria-hidden="true"
        />
    )
}
