# Sneaker

## Descripción

Sneaker es una plataforma de comercio electrónico desarrollada para un negocio de calzado deportivo y casual con sede en Concepción del Uruguay, Entre Ríos.

Actualmente, el emprendimiento realiza sus ventas a través de redes sociales (Instagram y WhatsApp) y cuenta con un almacén para la gestión de stock. El objetivo de este sistema es expandirse a nivel nacional, ofreciendo una tienda online completa y profesional.

El sistema permite a los usuarios consultar y buscar productos, gestionar compras, realizar pagos en línea y gestionar su perfil. Además, cuenta con un panel de administración para gestionar productos, promociones, ventas y estadísticas del negocio.

> **Nota:** El sistema está dirigido exclusivamente a consumidores finales.

## Características

- **Catálogo de productos**: Navegación, búsqueda y filtrado de calzado deportivo, casual y accesorios.
- **Asistente de búsqueda**: Recomendaciones personalizadas basadas en preferencias del usuario.
- **Autenticación**: Soporte para registro e inicio de sesión con proveedores externos (OAuth), con posibilidad de autenticación tradicional.
- **Gestión de perfil**: Favoritos, carrito de compras, direcciones, historial y seguimiento de pedidos.
- **Proceso de compra**: Integración con Mercado Pago para pagos seguros.
- **Promociones**: Cupones, combos, tarifas de envío y ofertas especiales.
- **Panel de administración**: Gestión de productos, stock, pedidos, promociones, estadísticas y soporte.
- **Notificaciones**: Alertas sobre pedidos, actualizaciones y eventos comerciales.
- **Responsive**: Diseño adaptable para distintos dispositivos (celulares, tablets y escritorio).

## Reglas de Negocio

- La navegación por el catálogo es libre, sin necesidad de autenticación.
- Es necesario autenticarse para realizar compras o utilizar favoritos.
- Los productos sin stock se marcan como no disponibles y tienen menor prioridad en búsquedas.
- La disponibilidad se valida al crear combos y al repetir compras.
- La información de compras debe persistirse y siempre requiere una dirección de envío válida.
- No existe interfaz para modificar el stock directamente (las extracciones deben registrarse con justificación).

## Documentación

La documentación completa del proyecto se encuentra en la wiki del repositorio: [Wiki - Sneaker](https://github.com/Chantun/sneaker_c/wiki).

## Licencia

Este proyecto está licenciado bajo la [GNU General Public License v3.0](LICENSE).
