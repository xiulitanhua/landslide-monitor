/**
 * 🔥 通用拖动功能
 * 使面板可以自由拖动
 */

import { ref, onMounted, onUnmounted } from 'vue';

export function useDraggable(elementRef, handleSelector = '.panel-header') {
    const position = ref({ x: 0, y: 0 });
    const isDragging = ref(false);
    
    let startX = 0;
    let startY = 0;
    let initialX = 0;
    let initialY = 0;
    
    const onMouseDown = (e) => {
        // 检查是否点击在标题栏上（排除按钮）
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
            return;
        }
        
        const element = elementRef.value;
        if (!element) return;
        
        // 检查是否点击在可拖动区域
        const handle = element.querySelector(handleSelector);
        if (handle && !handle.contains(e.target)) {
            return;
        }
        
        isDragging.value = true;
        
        const rect = element.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        initialX = rect.left;
        initialY = rect.top;
        
        // 设置初始位置（如果还没有）
        if (!element.style.left) {
            element.style.left = rect.left + 'px';
            element.style.top = rect.top + 'px';
            element.style.right = 'auto';
            element.style.bottom = 'auto';
        }
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        
        e.preventDefault();
    };
    
    const onMouseMove = (e) => {
        if (!isDragging.value) return;
        
        const element = elementRef.value;
        if (!element) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        let newX = initialX + deltaX;
        let newY = initialY + deltaY;
        
        // 边界限制
        const maxX = window.innerWidth - element.offsetWidth;
        const maxY = window.innerHeight - element.offsetHeight;
        
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));
        
        element.style.left = newX + 'px';
        element.style.top = newY + 'px';
        element.style.right = 'auto';
        element.style.bottom = 'auto';
        
        position.value = { x: newX, y: newY };
    };
    
    const onMouseUp = () => {
        isDragging.value = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
    
    const initDraggable = () => {
        const element = elementRef.value;
        if (!element) return;
        
        // 设置position为fixed或absolute
        const computedStyle = window.getComputedStyle(element);
        if (computedStyle.position === 'static') {
            element.style.position = 'absolute';
        }
        
        // 给标题栏添加拖动光标
        const handle = element.querySelector(handleSelector);
        if (handle) {
            handle.style.cursor = 'move';
            handle.addEventListener('mousedown', onMouseDown);
        }
    };
    
    const destroyDraggable = () => {
        const element = elementRef.value;
        if (!element) return;
        
        const handle = element.querySelector(handleSelector);
        if (handle) {
            handle.removeEventListener('mousedown', onMouseDown);
        }
        
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
    
    return {
        position,
        isDragging,
        initDraggable,
        destroyDraggable
    };
}
