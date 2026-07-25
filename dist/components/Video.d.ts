import type { VideoHTMLAttributes } from 'react';
export type VideoProps = Omit<VideoHTMLAttributes<HTMLVideoElement>, 'children' | 'src'> & {
    /** A URL supplied by the host application or its media resolver. */
    src: string;
    /** Accessible name and visible caption for the media. */
    title: string;
};
/**
 * A storage-agnostic document video primitive. It deliberately accepts only a
 * playable URL: hosts own authorization, CDN/object-store selection, and URL
 * renewal, while Docs Engine owns the document semantics and player rendering.
 */
export declare function Video({ className, poster, src, title, ...props }: VideoProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=Video.d.ts.map