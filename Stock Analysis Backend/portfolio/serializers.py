from rest_framework import serializers

from stocks.models import Stock
from .models import Portfolio


def _script_code(normalized_symbol):
    return normalized_symbol.split('.')[0] if normalized_symbol else normalized_symbol


class PortfolioSerializer(serializers.ModelSerializer):
    symbol = serializers.CharField(required=True, allow_blank=False, write_only=True)
    current_price = serializers.SerializerMethodField()
    total_value = serializers.SerializerMethodField()
    pnl = serializers.SerializerMethodField()
    net_gain = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()
    daily_change_percent = serializers.SerializerMethodField()

    class Meta:
        model = Portfolio
        fields = ['id', 'symbol', 'display_name', 'quantity', 'buy_price', 'date_added', 'current_price', 'total_value', 'pnl', 'net_gain', 'daily_change_percent']
        read_only_fields = ['id', 'date_added', 'current_price', 'total_value', 'pnl', 'net_gain']

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError('Quantity must be greater than zero.')
        return value

    def validate_buy_price(self, value):
        if value <= 0:
            raise serializers.ValidationError('Buy price must be greater than zero.')
        return value

    def validate_symbol(self, value):
        normalized = (value or '').strip().upper()
        if not normalized:
            raise serializers.ValidationError('A stock symbol is required.')
        return normalized

    def _resolve_stock(self, symbol):
        normalized = (symbol or '').strip().upper()
        if not normalized:
            return None

        exact = Stock.objects.filter(symbol__iexact=normalized).first()
        if exact:
            return exact

        if '.' not in normalized:
            ns_symbol = f'{normalized}.NS'
            return Stock.objects.filter(symbol__iexact=ns_symbol).first()

        return None

    def create(self, validated_data):
        symbol = validated_data.pop('symbol', None)
        if not symbol:
            raise serializers.ValidationError({'symbol': 'A stock symbol is required.'})

        user = validated_data.pop('user', None) or self.context['request'].user
        stock = self._resolve_stock(symbol)
        if stock is None:
            stock, _ = Stock.objects.get_or_create(symbol=symbol, defaults={'name': symbol})

        existing = Portfolio.objects.filter(user=user, stock=stock).first()
        if existing is not None:
            total_quantity = existing.quantity + validated_data['quantity']
            if total_quantity <= 0:
                raise serializers.ValidationError({'quantity': 'Total quantity must be greater than zero.'})

            weighted_price = (
                existing.buy_price * existing.quantity + validated_data['buy_price'] * validated_data['quantity']
            ) / total_quantity
            existing.quantity = total_quantity
            existing.buy_price = round(weighted_price, 2)
            existing.save()
            return existing

        return Portfolio.objects.create(user=user, stock=stock, **validated_data)

    def get_current_price(self, instance):
        return instance.stock.current_price or 0

    def get_display_name(self, instance):
        return f'{instance.stock.name} ({_script_code(instance.stock.symbol)})'

    def get_total_value(self, instance):
        return round((instance.stock.current_price or 0) * instance.quantity, 2)

    def get_pnl(self, instance):
        return round(((instance.stock.current_price or 0) - instance.buy_price) * instance.quantity, 2)

    def get_net_gain(self, instance):
        pnl = self.get_pnl(instance)
        brokerage = max(0.0, abs(pnl) * 0.003)
        return round(pnl - brokerage, 2)

    def get_daily_change_percent(self, instance):
        from stocks.models import StockHistory
        history = StockHistory.objects.filter(stock=instance.stock).order_by('-date')[:1]
        if history.exists():
            prev_close = history[0].close_price
            if prev_close > 0:
                current = instance.stock.current_price or prev_close
                change = ((current - prev_close) / prev_close) * 100
                return round(change, 2)
        return 0.0

    def to_representation(self, instance):
        data = super().to_representation(instance)
        raw_symbol = instance.stock.symbol
        data['symbol'] = raw_symbol.split('.')[0] if '.' in raw_symbol else raw_symbol
        return data
