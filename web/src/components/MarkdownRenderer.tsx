import { useMemo } from 'react'
import type { MarkdownTextPrimitiveProps } from '@assistant-ui/react-markdown'
import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown'
import { TextMessagePartProvider } from '@assistant-ui/react'
import { defaultComponents, useMarkdownPlugins } from '@/components/assistant-ui/markdown-text'
import { cn } from '@/lib/utils'

interface MarkdownRendererProps {
    content: string
    components?: MarkdownTextPrimitiveProps['components']
}

function MarkdownContent(props: MarkdownRendererProps) {
    const remarkPlugins = useMarkdownPlugins()
    const mergedComponents = props.components
        ? { ...defaultComponents, ...props.components }
        : defaultComponents

    const memoizedComponents = useMemo(() => mergedComponents, [mergedComponents])

    return (
        <TextMessagePartProvider text={props.content}>
            <MarkdownTextPrimitive
                remarkPlugins={remarkPlugins}
                components={memoizedComponents}
                className={cn('aui-md min-w-0 max-w-full break-words text-base')}
            />
        </TextMessagePartProvider>
    )
}

export function MarkdownRenderer(props: MarkdownRendererProps) {
    return <MarkdownContent {...props} />
}
