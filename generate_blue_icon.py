#!/usr/bin/env python3
"""
Generate Blue (Relaxed) themed MOODFOOD app icons
Creates all required sizes for web and mobile (PWA, iOS, Android)
"""

from PIL import Image, ImageDraw, ImageFont
import math
import os

# Icon sizes needed for PWA/mobile
ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512]

# Blue (Relaxed) color palette
COLORS = {
    'background': '#2D5F8B',      # Deep calming blue
    'accent': '#4A90C2',          # Lighter blue accent
    'highlight': '#7BB8E0',       # Soft highlight
    'leaf_main': '#3D7AB3',       # Main leaf color
    'leaf_dark': '#1E4A6B',       # Leaf shadow
    'text': '#FFFFFF',            # White text
}

def draw_leaf_icon(draw, size, colors):
    """Draw a stylized leaf/food icon representing mood food"""
    center_x = size // 2
    center_y = size // 2
    
    # Scale factor based on size
    scale = size / 512
    
    # Draw background circle with gradient effect
    padding = int(40 * scale)
    
    # Main circle background
    draw.ellipse(
        [padding, padding, size - padding, size - padding],
        fill=colors['background']
    )
    
    # Inner glow circle
    inner_padding = int(60 * scale)
    draw.ellipse(
        [inner_padding, inner_padding, size - inner_padding, size - inner_padding],
        fill=colors['accent']
    )
    
    # Draw stylized leaf shape (representing food/freshness)
    leaf_center_x = center_x
    leaf_center_y = center_y - int(10 * scale)
    leaf_width = int(160 * scale)
    leaf_height = int(200 * scale)
    
    # Leaf body (main shape)
    points = []
    num_points = 50
    for i in range(num_points):
        angle = (i / num_points) * 2 * math.pi
        # Create leaf shape using parametric equation
        if angle < math.pi:
            # Top half of leaf
            r = leaf_width * math.sin(angle) * 0.8
            y = leaf_center_y - leaf_height * 0.5 * math.cos(angle)
        else:
            # Bottom half (slightly pointed)
            r = leaf_width * math.sin(angle) * 0.6
            y = leaf_center_y - leaf_height * 0.5 * math.cos(angle)
        
        x = leaf_center_x + r * math.cos(angle - math.pi/2)
        points.append((x, y))
    
    # Draw leaf shadow
    shadow_points = [(p[0] + 5*scale, p[1] + 5*scale) for p in points]
    draw.polygon(shadow_points, fill=colors['leaf_dark'])
    
    # Draw main leaf
    draw.polygon(points, fill=colors['background'])
    
    # Draw a simple bowl/plate shape at bottom
    bowl_y = center_y + int(40 * scale)
    bowl_width = int(140 * scale)
    bowl_height = int(60 * scale)
    
    draw.arc(
        [center_x - bowl_width//2, bowl_y - bowl_height//2, 
         center_x + bowl_width//2, bowl_y + bowl_height//2],
        0, 180,
        fill=colors['highlight'],
        width=int(12 * scale)
    )
    
    # Draw stem/spoon handle
    stem_start_y = center_y - int(60 * scale)
    stem_end_y = center_y + int(20 * scale)
    draw.line(
        [(center_x, stem_start_y), (center_x, stem_end_y)],
        fill=colors['highlight'],
        width=int(10 * scale)
    )
    
    # Small decorative dots (representing food/ingredients)
    dot_positions = [
        (center_x - 40*scale, center_y - 20*scale),
        (center_x + 35*scale, center_y - 15*scale),
        (center_x - 15*scale, center_y + 25*scale),
    ]
    
    for pos in dot_positions:
        dot_size = int(15 * scale)
        draw.ellipse(
            [pos[0] - dot_size, pos[1] - dot_size, 
             pos[0] + dot_size, pos[1] + dot_size],
            fill=colors['highlight']
        )

def draw_simple_mf_icon(draw, size, colors):
    """Draw a simple, clean 'MF' monogram icon"""
    center_x = size // 2
    center_y = size // 2
    scale = size / 512
    
    # Background - rounded square with gradient effect
    padding = int(20 * scale)
    corner_radius = int(80 * scale)
    
    # Draw rounded rectangle background
    draw.rounded_rectangle(
        [padding, padding, size - padding, size - padding],
        radius=corner_radius,
        fill=colors['background']
    )
    
    # Inner rounded rectangle for depth
    inner_padding = int(40 * scale)
    draw.rounded_rectangle(
        [inner_padding, inner_padding, size - inner_padding, size - inner_padding],
        radius=int(corner_radius * 0.8),
        fill=colors['accent']
    )
    
    # Draw stylized fork/spoon icon
    utensil_x = center_x
    utensil_y = center_y
    
    # Fork prongs
    prong_width = int(12 * scale)
    prong_height = int(80 * scale)
    prong_spacing = int(25 * scale)
    prong_top = center_y - int(80 * scale)
    
    for i in range(-1, 2):
        x = center_x + i * prong_spacing
        draw.rounded_rectangle(
            [x - prong_width//2, prong_top, 
             x + prong_width//2, prong_top + prong_height],
            radius=prong_width//2,
            fill=colors['highlight']
        )
    
    # Fork handle
    handle_width = int(20 * scale)
    handle_top = prong_top + prong_height - int(10 * scale)
    handle_bottom = center_y + int(100 * scale)
    
    draw.rounded_rectangle(
        [center_x - handle_width//2, handle_top,
         center_x + handle_width//2, handle_bottom],
        radius=handle_width//2,
        fill=colors['highlight']
    )
    
    # Bowl curve at bottom
    bowl_y = center_y + int(50 * scale)
    bowl_radius = int(70 * scale)
    
    draw.arc(
        [center_x - bowl_radius, bowl_y,
         center_x + bowl_radius, bowl_y + bowl_radius],
        0, 180,
        fill=colors['text'],
        width=int(8 * scale)
    )

def draw_modern_mood_icon(draw, size, colors):
    """Draw a modern, minimal mood/food icon - stylized face in bowl"""
    center_x = size // 2
    center_y = size // 2
    scale = size / 512
    
    # Background circle
    padding = int(10 * scale)
    draw.ellipse(
        [padding, padding, size - padding, size - padding],
        fill=colors['background']
    )
    
    # Inner circle (lighter)
    inner_padding = int(35 * scale)
    draw.ellipse(
        [inner_padding, inner_padding, size - inner_padding, size - inner_padding],
        fill=colors['accent']
    )
    
    # Draw a simple smiling bowl representing "mood food"
    bowl_center_y = center_y + int(30 * scale)
    bowl_width = int(200 * scale)
    bowl_height = int(120 * scale)
    
    # Bowl outline (arc)
    draw.arc(
        [center_x - bowl_width//2, bowl_center_y - bowl_height//2,
         center_x + bowl_width//2, bowl_center_y + bowl_height//2 + int(40*scale)],
        0, 180,
        fill=colors['text'],
        width=int(16 * scale)
    )
    
    # Steam/aroma lines (representing warmth/comfort)
    steam_base_y = center_y - int(60 * scale)
    steam_height = int(50 * scale)
    
    for i, x_offset in enumerate([-40, 0, 40]):
        x = center_x + int(x_offset * scale)
        # Wavy steam line
        for j in range(3):
            y_start = steam_base_y - j * int(20 * scale)
            wave_offset = int(8 * scale) * (1 if j % 2 == 0 else -1)
            draw.arc(
                [x - int(15*scale), y_start - int(15*scale),
                 x + int(15*scale), y_start + int(15*scale)],
                180 if j % 2 == 0 else 0,
                360 if j % 2 == 0 else 180,
                fill=colors['highlight'],
                width=int(6 * scale)
            )
    
    # Two small dots for "eyes" in the bowl (friendly face)
    eye_y = bowl_center_y - int(10 * scale)
    eye_spacing = int(50 * scale)
    eye_size = int(12 * scale)
    
    for x_offset in [-eye_spacing//2, eye_spacing//2]:
        ex = center_x + x_offset
        draw.ellipse(
            [ex - eye_size, eye_y - eye_size,
             ex + eye_size, eye_y + eye_size],
            fill=colors['text']
        )
    
    # Small smile curve
    smile_y = bowl_center_y + int(20 * scale)
    smile_width = int(50 * scale)
    draw.arc(
        [center_x - smile_width//2, smile_y - int(20*scale),
         center_x + smile_width//2, smile_y + int(20*scale)],
        0, 180,
        fill=colors['text'],
        width=int(8 * scale)
    )

def create_icon(size, output_path):
    """Create a single icon at specified size"""
    # Create image with transparency support
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Use the modern mood icon design
    draw_modern_mood_icon(draw, size, COLORS)
    
    # Save as PNG
    img.save(output_path, 'PNG')
    print(f"Created: {output_path} ({size}x{size})")

def create_favicon(output_path):
    """Create favicon.ico with multiple sizes"""
    sizes = [16, 32, 48]
    images = []
    
    for size in sizes:
        img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        draw_modern_mood_icon(draw, size, COLORS)
        images.append(img)
    
    # Save as ICO (first image is primary, others are included)
    images[0].save(
        output_path, 
        format='ICO', 
        sizes=[(s, s) for s in sizes],
        append_images=images[1:]
    )
    print(f"Created: {output_path} (favicon with sizes {sizes})")

def main():
    # Output directories
    public_icons_dir = '/app/frontend/public/icons'
    public_dir = '/app/frontend/public'
    
    # Ensure directories exist
    os.makedirs(public_icons_dir, exist_ok=True)
    
    # Generate all PNG icon sizes
    for size in ICON_SIZES:
        output_path = os.path.join(public_icons_dir, f'icon-{size}x{size}.png')
        create_icon(size, output_path)
    
    # Generate the "original" large icon
    create_icon(512, os.path.join(public_icons_dir, 'icon-original.png'))
    
    # Generate favicon.ico
    create_favicon(os.path.join(public_dir, 'favicon.ico'))
    
    print("\n✅ All Blue (Relaxed) mood icons generated successfully!")
    print(f"Icons saved to: {public_icons_dir}")
    print(f"Favicon saved to: {public_dir}/favicon.ico")

if __name__ == '__main__':
    main()
