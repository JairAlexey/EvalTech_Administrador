from django.core.management.base import BaseCommand
from proxy.server_proxy import DynamicProxyManager

class Command(BaseCommand):
    help = 'Start the unified proxy gateway service'
    
    def handle(self, *args, **options):
        proxy_manager = DynamicProxyManager()
        try:
            proxy_manager.start_gateway()
            while True: 
                pass  
        except KeyboardInterrupt:
            proxy_manager.stop_gateway()
