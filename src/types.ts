export interface Detection { className:string; name:string; sourceClass?:string; confidence?:number; box?:{x:number;y:number;width:number;height:number}; points?:{x:number;y:number}[]; maskImage?:string }
export interface Analysis { detections:Detection[]; image:{width:number;height:number}; originalImage:string; annotatedImage?:string; status?:'detected'|'empty' }
